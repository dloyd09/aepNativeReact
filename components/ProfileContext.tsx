import React, { createContext, useContext, useRef, useState, ReactNode, useCallback } from 'react';

export type Profile = {
  firstName: string;
  email: string;
  phone?: string;
};

type ProfileContextType = {
  profile: Profile;
  saveProfile: (next: Profile) => Promise<void>;
  isProfileLoading: boolean;
  /**
   * Returns the latest profile synchronously. XDM event builders MUST call this
   * at send time rather than relying on a closure-captured `profile`, so events
   * fired right after login (e.g. checkout, purchase) stamp the new identity
   * instead of the previous (logged-out) value held by a stale render closure.
   */
  getProfile: () => Profile;
};

const EMPTY_PROFILE: Profile = { firstName: '', email: '' };

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const profileRef = useRef<Profile>(EMPTY_PROFILE);

  const saveProfile = useCallback(async (next: Profile) => {
    profileRef.current = next;
    setProfile(next);
  }, []);

  const getProfile = useCallback(() => profileRef.current, []);

  return (
    <ProfileContext.Provider value={{ profile, saveProfile, isProfileLoading: false, getProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider');
  return ctx;
}
