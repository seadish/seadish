export type Phase = 'lobby' | 'prep' | 'seek' | 'result' | 'final';
export type Team = 'seek' | 'hide' | 'wait';

export interface Meta {
  hostUid: string;
  phase: Phase;
  round: number;            // 0 = 아직 시작 안 함
  phaseEndsAt: number;      // 서버 시간 ms, lobby/final에서는 0
  paused: boolean;
  pausedAt: number;         // 멈춘 순간의 서버 시각(paused일 때만 의미)
  seekerOrder: string[];    // 입장 순서 uid
  seekerUid: string | null; // 이번 판 첫 술래
}
export interface Profile { name: string; prop: string | null; joinedAt: number; slot: string; }
export interface PlayerState { team: Team; caught: boolean; frozenUntil: number; score: number; caughtAt: number; }
export interface Pos { x: number; y: number; moving: boolean; }
export interface Action { uid: string; targetType: 'decor' | 'player'; targetId: string; at: number; }
export interface Player { profile: Profile; state: PlayerState; online: boolean; }
export interface RoomSnapshot { meta: Meta; players: Record<string, Player>; pos: Record<string, Pos>; hostOnline: boolean; }
