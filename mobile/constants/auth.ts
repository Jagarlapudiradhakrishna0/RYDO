export type UserProfile = {
  _id: string;
  name: string;
  phoneNumber: string;
  email: string;
  bikeNumber: string;
  bloodGroup: string;
  nativePlace: string;
  emergencyContact: {
    name: string;
    phoneNumber: string;
  };
  emergencyContactConsent: boolean;
  emergencyContactConsentAt?: string;
  profilePhoto?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

/* =====================================================
   ACTIVE USER SESSION STATE (In-Memory / Module Store)
===================================================== */

let activeUser: UserProfile | null = null;
const listeners = new Set<(user: UserProfile | null) => void>();

export function setCurrentUser(user: UserProfile | null) {
  activeUser = user;
  listeners.forEach((listener) => {
    try {
      listener(activeUser);
    } catch (e) {
      console.log('RYDO: Auth listener error:', e);
    }
  });
}

export function getCurrentUser(): UserProfile | null {
  return activeUser;
}

export function clearCurrentUser() {
  setCurrentUser(null);
}

export function subscribeToAuth(callback: (user: UserProfile | null) => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
