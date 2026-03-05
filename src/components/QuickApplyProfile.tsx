"use client";

import React, { useState } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { generateBookmarklet } from '@/context/BookmarkletGenerator';

export default function QuickApplyProfile() {
    const { profile, updateProfile, isProfileComplete } = useProfile();
    const [isOpen, setIsOpen] = useState(false);

    // Generate the Magic Script link
    const bookmarkletUrl = generateBookmarklet(profile);

    return (
        <div className={`fixed right-0 top-24 z-50 transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-[calc(100%-40px)]'}`}>
            <div className="flex">
                {/* Toggle Tab */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-10 h-32 bg-indigo-600 text-white rounded-l-xl border-y border-l border-indigo-700 shadow-2xl flex items-center justify-center cursor-pointer hover:bg-indigo-700"
                >
                    <span className="rotate-90 whitespace-nowrap text-xs font-bold tracking-widest">
                        {isOpen ? 'CLOSE PROFILE' : 'AUTO-FILL PROFILE'}
                    </span>
                </button>

                {/* Panel Content */}
                <div className="w-80 bg-white border-l border-gray-200 shadow-2xl h-[80vh] overflow-y-auto p-6 rounded-bl-2xl">
                    <div className="mb-6">
                        <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Quick Apply Profile</h2>
                        <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                            Fill your details once to use the <strong>Magic Fill</strong> feature on Greenhouse and Lever boards.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase">First Name</label>
                                <input
                                    type="text"
                                    value={profile.firstName}
                                    onChange={(e) => updateProfile({ firstName: e.target.value })}
                                    placeholder="First name"
                                    className="w-full text-sm border-gray-200 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Last Name</label>
                                <input
                                    type="text"
                                    value={profile.lastName}
                                    onChange={(e) => updateProfile({ lastName: e.target.value })}
                                    placeholder="Last name"
                                    className="w-full text-sm border-gray-200 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Location (City, State)</label>
                            <input
                                type="text"
                                value={profile.location}
                                onChange={(e) => updateProfile({ location: e.target.value })}
                                placeholder="New York, NY"
                                className="w-full text-sm border-gray-200 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Email Address</label>
                            <input
                                type="email"
                                value={profile.email}
                                onChange={(e) => updateProfile({ email: e.target.value })}
                                placeholder="your@email.com"
                                className="w-full text-sm border-gray-200 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Phone Number</label>
                            <input
                                type="text"
                                value={profile.phone}
                                onChange={(e) => updateProfile({ phone: e.target.value })}
                                placeholder="+1 (123) 456-7890"
                                className="w-full text-sm border-gray-200 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">LinkedIn Profile</label>
                            <input
                                type="text"
                                value={profile.linkedin}
                                onChange={(e) => updateProfile({ linkedin: e.target.value })}
                                placeholder="linkedin.com/in/..."
                                className="w-full text-sm border-gray-200 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">GitHub / Portfolio</label>
                            <input
                                type="text"
                                value={profile.github}
                                onChange={(e) => updateProfile({ github: e.target.value })}
                                placeholder="github.com/..."
                                className="w-full text-sm border-gray-200 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Gender / Sex</label>
                            <select
                                value={profile.gender || ""}
                                onChange={(e) => updateProfile({ gender: e.target.value })}
                                className="w-full text-sm border-gray-200 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="">Select...</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Non-binary">Non-binary</option>
                                <option value="Decline to answer">Decline to answer</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Race / Ethnicity</label>
                            <select
                                value={profile.race || ""}
                                onChange={(e) => updateProfile({ race: e.target.value })}
                                className="w-full text-sm border-gray-200 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                            >
                                <option value="">Select...</option>
                                <option value="Asian">Asian</option>
                                <option value="White">White</option>
                                <option value="Black or African American">Black or African American</option>
                                <option value="Hispanic or Latino">Hispanic or Latino</option>
                                <option value="Native Hawaiian or Pacific Islander">Native Hawaiian or Pacific Islander</option>
                                <option value="American Indian or Alaska Native">American Indian or Alaska Native</option>
                                <option value="Two or More Races">Two or More Races</option>
                                <option value="Decline to answer">Decline to answer</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t">
                        <h3 className="text-xs font-bold text-gray-900 mb-2 uppercase tracking-wide italic">✨ The Magic Fill Feature</h3>
                        <p className="text-[10px] text-gray-600 mb-4 bg-indigo-50 p-2 rounded-md border border-indigo-100">
                            Drag the button below to your <strong>Bookmarks Bar</strong>. When you are on a Greenhouse/Lever application page, click it to instantly fill all the fields!
                        </p>

                        <a
                            href={isProfileComplete ? bookmarkletUrl : "#"}
                            className={`block text-center py-3 px-4 rounded-xl font-bold text-sm shadow-indigo-100 shadow-lg transition-all active:scale-95 select-none ${isProfileComplete ? 'bg-indigo-600 text-white cursor-move hover:bg-indigo-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed border'
                                }`}
                            onClick={(e) => {
                                if (!isProfileComplete) {
                                    e.preventDefault();
                                    alert('Please fill your name and email first!');
                                } else {
                                    e.preventDefault();
                                    alert('Drag this button to your Bookmarks Bar! Do not just click it.');
                                }
                            }}
                        >
                            DRAG ME TO BOOKMARKS
                        </a>

                        <p className="mt-4 text-[9px] text-center text-gray-400 uppercase font-black">
                            Works on 100+ Boards
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
