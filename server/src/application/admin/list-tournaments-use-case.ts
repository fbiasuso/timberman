import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { TicketRepo } from '../../domain/ports/ticket-repo.js';
import type { UserRepo } from '../../domain/ports/user-repo.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface WinnerDTO {
  ticketId: number;
  userId: string;
  username: string;
  prize: number; // cents
}

export interface TournamentDateDTO {
  id: number;
  dateNumber: number;
  status: string;
  pozo: number; // cents
  betAmount: number; // cents
  commission: number; // percent — snapshot taken at close
  winners: WinnerDTO[];
}

export interface AdminTournamentDTO {
  id: number;
  name: string;
  commission: number;
  status: string;
  finishedAt: Date | null;
  carryover: number; // cents — unpaid pozo rolled to the next date
  createdAt: Date;
  dates: TournamentDateDTO[];
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Returns all tournaments with their match dates and payout breakdown
 * (admin view). Winners are read from `tickets.prizeWon`, which is set
 * when results are published.
 */
export class ListTournamentsUseCase {
  constructor(
    private readonly tournamentRepo: TournamentRepo,
    private readonly ticketRepo: TicketRepo,
    private readonly userRepo: UserRepo,
  ) {}

  async execute(): Promise<AdminTournamentDTO[]> {
    const tournaments = await this.tournamentRepo.findAll();
    const result: AdminTournamentDTO[] = [];

    for (const tournament of tournaments) {
      const snap = tournament.toSnapshot();
      const dates = await this.tournamentRepo.findMatchDatesByTournamentId(tournament.id);

      const dateDTOs: TournamentDateDTO[] = [];
      for (const date of dates) {
        const dateSnap = date.toSnapshot();
        const tickets = await this.ticketRepo.findByMatchDateId(date.id);

        const winners: WinnerDTO[] = [];
        for (const ticket of tickets) {
          if (ticket.prizeWon === null) continue;
          const user = await this.userRepo.findById(ticket.userId);
          winners.push({
            ticketId: ticket.id,
            userId: ticket.userId,
            username: user?.username ?? 'unknown',
            prize: ticket.prizeWon,
          });
        }

        dateDTOs.push({
          id: dateSnap.id,
          dateNumber: dateSnap.dateNumber,
          status: dateSnap.status,
          pozo: dateSnap.pozo,
          betAmount: dateSnap.betAmount,
          commission: dateSnap.commission,
          winners,
        });
      }

      result.push({
        id: snap.id,
        name: snap.name,
        commission: snap.commission,
        status: snap.status,
        finishedAt: snap.finishedAt,
        carryover: snap.carryover,
        createdAt: snap.createdAt,
        dates: dateDTOs,
      });
    }

    return result;
  }
}
