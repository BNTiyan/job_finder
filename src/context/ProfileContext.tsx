"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserProfile {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    linkedin: string;
    github: string;
    portfolio: string;
    location: string;
}

interface ProfileContextType {
    profile: UserProfile;
    updateProfile: (updates: Partial<UserProfile>) => void;
    isProfileComplete: boolean;
}

const DEFAULT_PROFILE: UserProfile = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    linkedin: '',
    github: '',
    portfolio: '',
    location: '',
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
    const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);

    useEffect(() => {
        const saved = localStorage.getItem('user_profile');
        if (saved) {
            try {
                setProfile(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse saved profile", e);
            }
        }
    }, []);

    const updateProfile = (updates: Partial<UserProfile>) => {
        const newProfile = { ...profile, ...updates };
        setProfile(newProfile);
        localStorage.setItem('user_profile', JSON.stringify(newProfile));
    };

    const isProfileComplete = !!(profile.firstName && profile.lastName && profile.email);

    return (
        <ProfileContext.Provider value={{ profile, updateProfile, isProfileComplete }}>
            {children}
        </ProfileContext.Provider>
    );
}

export function useProfile() {
    const context = useContext(ProfileContext);
    if (!context) throw new Error('useProfile must be used within ProfileProvider');
    return context;
}
