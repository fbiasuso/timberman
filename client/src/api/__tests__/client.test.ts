import { describe, expect, it } from 'vitest';
import { resolveApiBaseURL } from '../client';

describe('resolveApiBaseURL', () => {
  it('falls back to a relative /api when VITE_API_URL is not set', () => {
    expect(resolveApiBaseURL(undefined)).toBe('/api');
  });

  it('appends /api to a bare API origin', () => {
    expect(resolveApiBaseURL('https://timberman-api.onrender.com')).toBe(
      'https://timberman-api.onrender.com/api',
    );
  });

  it('normalizes a trailing slash before appending /api', () => {
    expect(resolveApiBaseURL('https://timberman-api.onrender.com/')).toBe(
      'https://timberman-api.onrender.com/api',
    );
  });

  it('keeps the value unchanged when it already ends with /api', () => {
    expect(resolveApiBaseURL('https://timberman-api.onrender.com/api')).toBe(
      'https://timberman-api.onrender.com/api',
    );
  });

  it('keeps the value unchanged for an /api/ trailing-slash value', () => {
    expect(resolveApiBaseURL('https://timberman-api.onrender.com/api/')).toBe(
      'https://timberman-api.onrender.com/api',
    );
  });

  it('appends /api to a localhost origin', () => {
    expect(resolveApiBaseURL('http://localhost:3001')).toBe('http://localhost:3001/api');
  });
});