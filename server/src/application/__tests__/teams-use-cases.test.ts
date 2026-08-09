import { describe, it, expect, vi } from 'vitest';
import type { LeagueRepo } from '../../domain/ports/league-repo.js';
import type { TeamRepo } from '../../domain/ports/team-repo.js';
import type { ImageService } from '../../domain/ports/image-service.js';
import { League } from '../../domain/entities/league.js';
import { Team } from '../../domain/entities/team.js';
import {
  LeagueNotFoundError,
  LeagueNameAlreadyExistsError,
  LeagueHasTeamsError,
  TeamNotFoundError,
  TeamNameAlreadyExistsError,
  TeamNeedsLeagueError,
  TeamReferencedByMatchesError,
} from '../../domain/errors/index.js';
import { CreateLeagueUseCase } from '../teams/create-league-use-case.js';
import { UpdateLeagueUseCase } from '../teams/update-league-use-case.js';
import { DeleteLeagueUseCase } from '../teams/delete-league-use-case.js';
import { ListLeaguesUseCase } from '../teams/list-leagues-use-case.js';
import { ListTeamsByLeagueUseCase } from '../teams/list-teams-by-league-use-case.js';
import { CreateTeamUseCase } from '../teams/create-team-use-case.js';
import { UpdateTeamUseCase } from '../teams/update-team-use-case.js';
import { DeleteTeamUseCase } from '../teams/delete-team-use-case.js';

// ── Fixtures ──────────────────────────────────────────────────────

const leagueSnap = {
  id: 1,
  name: 'Primera División',
  country: 'Argentina',
  format: 'liga' as const,
  createdAt: new Date('2026-08-01T00:00:00Z'),
};

const teamSnap = {
  id: 7,
  name: 'River Plate',
  aliases: ['El Millonario'],
  logo: null,
  leagueIds: [1],
  createdAt: new Date('2026-08-01T00:00:00Z'),
};

function createRepos() {
  const leagueRepo: LeagueRepo = {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByName: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    countTeams: vi.fn(),
  };
  const teamRepo: TeamRepo = {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByLeagueId: vi.fn(),
    findByName: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    countMatchesReferencing: vi.fn(),
  };
  return { leagueRepo, teamRepo };
}

// ── Leagues ───────────────────────────────────────────────────────

describe('League use cases', () => {
  describe('CreateLeagueUseCase', () => {
    it('creates a league and returns its DTO', async () => {
      const { leagueRepo } = createRepos();
      vi.mocked(leagueRepo.save).mockResolvedValue(League.create(leagueSnap));

      const dto = await new CreateLeagueUseCase(leagueRepo).execute({
        name: 'Primera División',
        country: 'Argentina',
        format: 'liga',
      });

      expect(dto.id).toBe(1);
      expect(dto.name).toBe('Primera División');
      expect(dto.format).toBe('liga');
    });

    it('propagates the normalized-name collision (409) from the repo', async () => {
      const { leagueRepo } = createRepos();
      vi.mocked(leagueRepo.save).mockRejectedValue(
        new LeagueNameAlreadyExistsError('primera division'),
      );

      await expect(new CreateLeagueUseCase(leagueRepo).execute({
        name: 'primera division',
        country: 'Argentina',
        format: 'liga',
      })).rejects.toBeInstanceOf(LeagueNameAlreadyExistsError);
    });
  });

  describe('UpdateLeagueUseCase', () => {
    it('applies a partial rename keeping other fields', async () => {
      const { leagueRepo } = createRepos();
      vi.mocked(leagueRepo.findById).mockResolvedValue(League.create(leagueSnap));
      vi.mocked(leagueRepo.update).mockResolvedValue(
        League.create({ ...leagueSnap, name: 'Torneo Apertura' }),
      );

      const dto = await new UpdateLeagueUseCase(leagueRepo).execute({
        leagueId: 1,
        name: 'Torneo Apertura',
      });

      expect(dto.name).toBe('Torneo Apertura');
      expect(dto.country).toBe('Argentina');
    });

    it('throws LeagueNotFoundError for an unknown league', async () => {
      const { leagueRepo } = createRepos();
      vi.mocked(leagueRepo.findById).mockResolvedValue(null);

      await expect(new UpdateLeagueUseCase(leagueRepo).execute({
        leagueId: 99,
        name: 'X',
      })).rejects.toBeInstanceOf(LeagueNotFoundError);
    });
  });

  describe('DeleteLeagueUseCase', () => {
    it('deletes an empty league', async () => {
      const { leagueRepo } = createRepos();
      vi.mocked(leagueRepo.findById).mockResolvedValue(League.create(leagueSnap));
      vi.mocked(leagueRepo.countTeams).mockResolvedValue(0);

      await new DeleteLeagueUseCase(leagueRepo).execute(1);

      expect(leagueRepo.delete).toHaveBeenCalledWith(1);
    });

    it('blocks deletion while the league has memberships (409)', async () => {
      const { leagueRepo } = createRepos();
      vi.mocked(leagueRepo.findById).mockResolvedValue(League.create(leagueSnap));
      vi.mocked(leagueRepo.countTeams).mockResolvedValue(2);

      await expect(new DeleteLeagueUseCase(leagueRepo).execute(1))
        .rejects.toBeInstanceOf(LeagueHasTeamsError);
      expect(leagueRepo.delete).not.toHaveBeenCalled();
    });

    it('throws LeagueNotFoundError for an unknown league', async () => {
      const { leagueRepo } = createRepos();
      vi.mocked(leagueRepo.findById).mockResolvedValue(null);

      await expect(new DeleteLeagueUseCase(leagueRepo).execute(99))
        .rejects.toBeInstanceOf(LeagueNotFoundError);
    });
  });

  describe('ListLeaguesUseCase', () => {
    it('nests member teams per league; multi-league teams appear in both', async () => {
      const { leagueRepo, teamRepo } = createRepos();
      const leagueA = League.create(leagueSnap);
      const leagueB = League.create({ ...leagueSnap, id: 2, name: 'Copa Argentina', format: 'copa' });
      const shared = Team.create({ ...teamSnap, leagueIds: [1, 2], name: 'River Plate' });
      vi.mocked(leagueRepo.findAll).mockResolvedValue([leagueA, leagueB]);
      vi.mocked(teamRepo.findAll).mockResolvedValue([shared]);

      const leagues = await new ListLeaguesUseCase(leagueRepo, teamRepo).execute();

      expect(leagues).toHaveLength(2);
      expect(leagues[0].teams).toHaveLength(1);
      expect(leagues[1].teams).toHaveLength(1);
      expect(leagues[0].teams[0].leagueIds).toEqual([1, 2]);
    });
  });

  describe('ListTeamsByLeagueUseCase', () => {
    it('returns only teams with a membership in the league', async () => {
      const { leagueRepo, teamRepo } = createRepos();
      vi.mocked(leagueRepo.findById).mockResolvedValue(League.create(leagueSnap));
      vi.mocked(teamRepo.findByLeagueId).mockResolvedValue([
        Team.create({ ...teamSnap, leagueIds: [1] }),
      ]);

      const teams = await new ListTeamsByLeagueUseCase(teamRepo, leagueRepo).execute(1);

      expect(teams).toHaveLength(1);
      expect(teamRepo.findByLeagueId).toHaveBeenCalledWith(1);
    });

    it('throws LeagueNotFoundError for an unknown league', async () => {
      const { leagueRepo, teamRepo } = createRepos();
      vi.mocked(leagueRepo.findById).mockResolvedValue(null);

      await expect(new ListTeamsByLeagueUseCase(teamRepo, leagueRepo).execute(99))
        .rejects.toBeInstanceOf(LeagueNotFoundError);
    });
  });
});

// ── Teams ─────────────────────────────────────────────────────────

describe('Team use cases', () => {
  describe('CreateTeamUseCase', () => {
    it('dedupes leagueIds and resolves every league before saving', async () => {
      const { leagueRepo, teamRepo } = createRepos();
      vi.mocked(leagueRepo.findById).mockResolvedValue(League.create(leagueSnap));
      vi.mocked(teamRepo.save).mockResolvedValue(Team.create(teamSnap));

      const dto = await new CreateTeamUseCase(teamRepo, leagueRepo).execute({
        name: 'River Plate',
        aliases: ['El Millonario'],
        leagueIds: [1, 1, 2],
      });

      expect(dto.leagueIds).toEqual([1]);
      expect(teamRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ leagueIds: [1, 2] }),
      );
    });

    it('rejects an empty membership set (400)', async () => {
      const { leagueRepo, teamRepo } = createRepos();

      await expect(new CreateTeamUseCase(teamRepo, leagueRepo).execute({
        name: 'River Plate',
        leagueIds: [],
      })).rejects.toBeInstanceOf(TeamNeedsLeagueError);
    });

    it('rejects an unknown league id (404)', async () => {
      const { leagueRepo, teamRepo } = createRepos();
      vi.mocked(leagueRepo.findById).mockResolvedValue(null);

      await expect(new CreateTeamUseCase(teamRepo, leagueRepo).execute({
        name: 'River Plate',
        leagueIds: [1],
      })).rejects.toBeInstanceOf(LeagueNotFoundError);
    });

    it('propagates the global name collision (409) from the repo', async () => {
      const { leagueRepo, teamRepo } = createRepos();
      vi.mocked(leagueRepo.findById).mockResolvedValue(League.create(leagueSnap));
      vi.mocked(teamRepo.save).mockRejectedValue(
        new TeamNameAlreadyExistsError('river plate'),
      );

      await expect(new CreateTeamUseCase(teamRepo, leagueRepo).execute({
        name: 'river plate',
        leagueIds: [1],
      })).rejects.toBeInstanceOf(TeamNameAlreadyExistsError);
    });

    it('keeps logo null when the shield download fails (never blocks)', async () => {
      const { leagueRepo, teamRepo } = createRepos();
      const imageService: ImageService = {
        downloadAndStore: vi.fn().mockResolvedValue(null),
        storeFromBuffer: vi.fn().mockResolvedValue(null),
      };
      vi.mocked(leagueRepo.findById).mockResolvedValue(League.create(leagueSnap));
      vi.mocked(teamRepo.save).mockResolvedValue(Team.create(teamSnap));

      const dto = await new CreateTeamUseCase(teamRepo, leagueRepo, imageService).execute({
        name: 'River Plate',
        logoUrl: 'https://example.com/shield.png',
        leagueIds: [1],
      });

      expect(dto.logo).toBeNull();
      expect(teamRepo.update).not.toHaveBeenCalled();
    });

    it('stores the downloaded logo path and persists it', async () => {
      const { leagueRepo, teamRepo } = createRepos();
      const imageService: ImageService = {
        downloadAndStore: vi.fn().mockResolvedValue('logos/7.png'),
        storeFromBuffer: vi.fn().mockResolvedValue(null),
      };
      vi.mocked(leagueRepo.findById).mockResolvedValue(League.create(leagueSnap));
      vi.mocked(teamRepo.save).mockResolvedValue(Team.create(teamSnap));
      vi.mocked(teamRepo.update).mockResolvedValue(
        Team.create({ ...teamSnap, logo: 'logos/7.png' }),
      );

      const dto = await new CreateTeamUseCase(teamRepo, leagueRepo, imageService).execute({
        name: 'River Plate',
        logoUrl: 'https://example.com/shield.png',
        leagueIds: [1],
      });

      expect(imageService.downloadAndStore).toHaveBeenCalledWith('https://example.com/shield.png', 7);
      expect(dto.logo).toBe('logos/7.png');
      expect(teamRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ logo: 'logos/7.png' }),
      );
    });
  });

  describe('UpdateTeamUseCase', () => {
    it('applies a partial rename keeping other fields and memberships', async () => {
      const { leagueRepo, teamRepo } = createRepos();
      vi.mocked(teamRepo.findById).mockResolvedValue(Team.create(teamSnap));
      vi.mocked(leagueRepo.findById).mockResolvedValue(League.create(leagueSnap));
      vi.mocked(teamRepo.update).mockResolvedValue(
        Team.create({ ...teamSnap, name: 'River Plate FC' }),
      );

      const dto = await new UpdateTeamUseCase(teamRepo, leagueRepo).execute({
        teamId: 7,
        name: 'River Plate FC',
      });

      expect(dto.name).toBe('River Plate FC');
      expect(dto.leagueIds).toEqual([1]);
    });

    it('rejects removing the last membership (400)', async () => {
      const { leagueRepo, teamRepo } = createRepos();
      vi.mocked(teamRepo.findById).mockResolvedValue(Team.create(teamSnap));

      await expect(new UpdateTeamUseCase(teamRepo, leagueRepo).execute({
        teamId: 7,
        leagueIds: [],
      })).rejects.toBeInstanceOf(TeamNeedsLeagueError);
      expect(teamRepo.update).not.toHaveBeenCalled();
    });

    it('replaces the membership set and resolves new league ids', async () => {
      const { leagueRepo, teamRepo } = createRepos();
      vi.mocked(teamRepo.findById).mockResolvedValue(Team.create(teamSnap));
      vi.mocked(leagueRepo.findById).mockResolvedValue(
        League.create({ ...leagueSnap, id: 2, name: 'Copa Argentina', format: 'copa' }),
      );
      vi.mocked(teamRepo.update).mockResolvedValue(
        Team.create({ ...teamSnap, leagueIds: [2] }),
      );

      const dto = await new UpdateTeamUseCase(teamRepo, leagueRepo).execute({
        teamId: 7,
        leagueIds: [2],
      });

      expect(dto.leagueIds).toEqual([2]);
    });

    it('rejects an unknown league id in the new set (404)', async () => {
      const { leagueRepo, teamRepo } = createRepos();
      vi.mocked(teamRepo.findById).mockResolvedValue(Team.create(teamSnap));
      vi.mocked(leagueRepo.findById).mockResolvedValue(null);

      await expect(new UpdateTeamUseCase(teamRepo, leagueRepo).execute({
        teamId: 7,
        leagueIds: [99],
      })).rejects.toBeInstanceOf(LeagueNotFoundError);
    });

    it('throws TeamNotFoundError for an unknown team', async () => {
      const { leagueRepo, teamRepo } = createRepos();
      vi.mocked(teamRepo.findById).mockResolvedValue(null);

      await expect(new UpdateTeamUseCase(teamRepo, leagueRepo).execute({
        teamId: 99,
        name: 'X',
      })).rejects.toBeInstanceOf(TeamNotFoundError);
    });
  });

  describe('DeleteTeamUseCase', () => {
    it('deletes an unreferenced team', async () => {
      const { teamRepo } = createRepos();
      vi.mocked(teamRepo.findById).mockResolvedValue(Team.create(teamSnap));
      vi.mocked(teamRepo.countMatchesReferencing).mockResolvedValue(0);

      await new DeleteTeamUseCase(teamRepo).execute(7);

      expect(teamRepo.delete).toHaveBeenCalledWith(7);
    });

    it('blocks deletion of a match-referenced team (409)', async () => {
      const { teamRepo } = createRepos();
      vi.mocked(teamRepo.findById).mockResolvedValue(Team.create(teamSnap));
      vi.mocked(teamRepo.countMatchesReferencing).mockResolvedValue(1);

      await expect(new DeleteTeamUseCase(teamRepo).execute(7))
        .rejects.toBeInstanceOf(TeamReferencedByMatchesError);
      expect(teamRepo.delete).not.toHaveBeenCalled();
    });

    it('throws TeamNotFoundError for an unknown team', async () => {
      const { teamRepo } = createRepos();
      vi.mocked(teamRepo.findById).mockResolvedValue(null);

      await expect(new DeleteTeamUseCase(teamRepo).execute(99))
        .rejects.toBeInstanceOf(TeamNotFoundError);
    });
  });
});
