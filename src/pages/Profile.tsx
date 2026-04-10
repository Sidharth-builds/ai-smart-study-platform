import React, { useState, useEffect } from 'react';
import { Activity, Bell, Clock3, Flame, GraduationCap, Mail, Shield, Trophy, UserCircle } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { getTotalStudyHours, getSummariesCreated, getCurrentStreak } from '../services/profileService';
import { collection, query, where, limit, getDocs, Timestamp, doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../lib/firebaseService';

interface ActivityItem {
  id: string;
  action: string;
  timestamp: Timestamp;
}

interface UserProfile {
  name: string;
  studyStream: string;
}

export default function Profile() {
  const { user } = useAuth();
  const [totalStudyTime, setTotalStudyTime] = useState(0);
  const [summariesCreated, setSummariesCreated] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [flashcardsMastery, setFlashcardsMastery] = useState(0);
  const [studyHoursThisWeek, setStudyHoursThisWeek] = useState(0);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: '', studyStream: '' });
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>({});
  const [stream, setStream] = useState('');

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchUser().then(() => updateStreak());
    }
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;
    try {
      const [studyTime, summaries, streak, mastery, hoursWeek, activityList, profile] = await Promise.all([
        getTotalStudyHours(user.uid).catch(() => 0),
        getSummariesCreated(user.uid).catch(() => 0),
        getCurrentStreak(user.uid).catch(() => 0),
        getFlashcardsMastery(user.uid).catch(() => 0),
        getStudyHoursThisWeek(user.uid).catch(() => 0),
        getRecentActivities(user.uid).catch(() => []),
        getUserProfile(user.uid)
      ]);
      setTotalStudyTime(studyTime);
      setSummariesCreated(summaries);
      setCurrentStreak(streak);
      setFlashcardsMastery(mastery);
      setStudyHoursThisWeek(hoursWeek);
      setActivities(activityList);
      setUserProfile(profile);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const getFlashcardsMastery = async (userId: string): Promise<number> => {
    const q = query(collection(db, COLLECTIONS.FLASHCARDS), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const cards = querySnapshot.docs.map(doc => doc.data());
    const totalCards = cards.length;
    const masteredCards = cards.filter((card: any) => card.mastered).length;
    return totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0;
  };

  const getStudyHoursThisWeek = async (userId: string): Promise<number> => {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    startOfWeek.setHours(0, 0, 0, 0);
    
    const q = query(
      collection(db, COLLECTIONS.STUDY_SESSIONS),
      where('userId', '==', userId),
      where('createdAt', '>=', Timestamp.fromDate(startOfWeek))
    );
    const querySnapshot = await getDocs(q);
    const sessions = querySnapshot.docs.map(doc => doc.data());
    return sessions.reduce((total: number, session: any) => total + (session.duration || 0), 0);
  };

  const getRecentActivities = async (userId: string): Promise<ActivityItem[]> => {
    const q = query(
      collection(db, 'activity'),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    const activities = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityItem));
    const getMillis = (value: any) =>
      value?.toMillis ? value.toMillis() : value instanceof Date ? value.getTime() : new Date(value || 0).getTime();
    return activities
      .sort((a, b) => getMillis(b.timestamp) - getMillis(a.timestamp))
      .slice(0, 10);
  };

  const getUserProfile = async (userId: string): Promise<UserProfile> => {
    const fallbackName = user?.displayName || user?.email?.split('@')[0] || 'User';
    const fallbackStream = 'Not set yet';

    try {
      const userDoc = await getDoc(doc(db, 'users', userId));

      if (!userDoc.exists()) {
        return {
          name: fallbackName,
          studyStream: fallbackStream,
        };
      }

      const data = userDoc.data();
      return {
        name: data.name || data.displayName || fallbackName,
        studyStream: data.studyStream || data.stream || fallbackStream,
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return {
        name: fallbackName,
        studyStream: fallbackStream,
      };
    }
  };

  const fetchUser = async () => {
    if (!user) return;
    const docRef = doc(db, "users", user.uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      setUserData(data);
      setStream(data.stream || '');
    }
  };

  const saveStream = async () => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), {
      stream: stream
    }, { merge: true });
    await fetchUser(); // Refresh data
  };

  const updateStreak = async () => {
    if (!user) return;
    const today = new Date().toDateString();
    if (userData.lastActiveDate !== today) {
      let newStreak = userData.streak || 0;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (userData.lastActiveDate === yesterday.toDateString()) {
        newStreak += 1;
      } else {
        newStreak = 1;
      }
      await setDoc(doc(db, "users", user.uid), {
        streak: newStreak,
        lastActiveDate: today
      }, { merge: true });
      setUserData({ ...userData, streak: newStreak, lastActiveDate: today });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-2 sm:px-6 lg:px-8">
      <header className="px-1">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">User Profile</h1>
        <p className="text-slate-400 dark:text-slate-400">Manage your account and study preferences.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0d1425] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center">
            <div className="mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-full border-4 border-indigo-600/10 bg-indigo-600/20">
              <UserCircle className="h-20 w-20 text-indigo-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{userProfile.name}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">🚀 Active Learner</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{userData.stream || "Not set yet"}</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{user?.email || 'No email found'}</p>
            <div className="mt-4">
              <input
                type="text"
                placeholder="Enter your study stream"
                value={stream}
                onChange={(e) => setStream(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <button onClick={saveStream} className="mt-2 w-full rounded-lg bg-indigo-600 py-2 font-bold text-white transition-all hover:bg-indigo-500">
                Save
              </button>
            </div>
            <button className="mt-6 w-full rounded-xl bg-indigo-600 py-3 font-bold text-white transition-all hover:bg-indigo-500">
              Manage Account
            </button>
          </div>

          <div className="bg-white dark:bg-[#0d1425] border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Study Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400 text-sm">Total Study Time</span>
                <span className="text-slate-900 dark:text-white font-bold">{(userData.studyTime || 0) === 0 ? 'No data yet' : (userData.studyTime || 0).toFixed(1) + ' Hours'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400 text-sm">Summaries Created</span>
                <span className="text-slate-900 dark:text-white font-bold">{(userData.summaries || 0) === 0 ? 'No summaries yet' : userData.summaries || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400 text-sm">Current Streak</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{(userData.streak || 0) === 0 ? 'No streak yet' : (userData.streak || 0) + ' Days'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0d1425] border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Progress Analytics</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400 text-sm">Flashcards Mastery</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold">{flashcardsMastery}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400 text-sm">Study Hours This Week</span>
                <span className="text-violet-600 dark:text-violet-400 font-bold">{studyHoursThisWeek.toFixed(1)} Hours</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0d1425] border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {activities.length > 0 ? (
                activities.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-3 rounded-lg bg-slate-100 p-3 dark:bg-slate-800/50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600/20">
                      <Activity className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-slate-900 dark:text-white text-sm font-medium">{activity.action}</p>
                      <p className="text-slate-500 dark:text-slate-400 text-xs">
                        {activity.timestamp?.toDate().toLocaleDateString()} at {activity.timestamp?.toDate().toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-4">Start studying to see your activity here</p>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#0d1425] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Account Settings</h3>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              <div className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900">
                    <Mail className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">Email Address</p>
                    <p className="text-slate-900 dark:text-white font-medium">{user?.email || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {[
                { icon: UserCircle, label: 'Full Name', value: userProfile.name },
                { icon: GraduationCap, label: 'Study Stream', value: userData.stream || "Not set yet" },
                { icon: Shield, label: 'Privacy & Security', value: 'Manage your account access' },
                { icon: Bell, label: 'Notifications', value: 'Manage study alerts and reminders' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-6 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/20">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900">
                      <item.icon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">{item.label}</p>
                      <p className="text-slate-900 dark:text-white font-medium">{item.value}</p>
                    </div>
                  </div>
                </div>
              ))}

              <div className="grid gap-4 p-6 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
                  <div className="mb-2 flex items-center gap-2 text-slate-900 dark:text-white">
                    <Clock3 className="h-4 w-4 text-indigo-500" />
                    <span className="font-semibold">Study Time</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{(userData.studyTime || 0) === 0 ? 'No data yet' : (userData.studyTime || 0).toFixed(1) + ' hrs'}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total tracked learning time</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
                  <div className="mb-2 flex items-center gap-2 text-slate-900 dark:text-white">
                    <Flame className="h-4 w-4 text-emerald-500" />
                    <span className="font-semibold">Current Streak</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{(userData.streak || 0) === 0 ? 'No streak yet' : (userData.streak || 0) + ' days'}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Keep the momentum going</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
                  <div className="mb-2 flex items-center gap-2 text-slate-900 dark:text-white">
                    <GraduationCap className="h-4 w-4 text-blue-500" />
                    <span className="font-semibold">Flashcard Mastery</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{flashcardsMastery}%</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Cards marked as mastered</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
                  <div className="mb-2 flex items-center gap-2 text-slate-900 dark:text-white">
                    <Trophy className="h-4 w-4 text-violet-500" />
                    <span className="font-semibold">Summaries Created</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{(userData.summaries || 0) === 0 ? 'No summaries yet' : userData.summaries || 0}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">AI notes generated so far</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
