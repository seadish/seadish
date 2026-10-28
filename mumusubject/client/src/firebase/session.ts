// client/src/firebase/session.ts
import type { UserProfile } from './userStore';

let _profile: UserProfile | null = null;

export function setProfile(p: UserProfile | null): void { _profile = p; }
export function getProfile(): UserProfile | null { return _profile; }
