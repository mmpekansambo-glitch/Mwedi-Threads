import type { ReactNode } from "react";

const mockUser = {
  id: "user_mwedi_e2e",
  firstName: "Sample",
  lastName: "Maker",
  fullName: "Sample Maker",
  username: "samplemaker",
};

const mockClerk = {
  addListener: () => () => undefined,
  signOut: async () => undefined,
  openSignIn: () => undefined,
  openSignUp: () => undefined,
};

export function ClerkProvider({ children }: { children: ReactNode }) {
  return children;
}

export function SignIn() {
  return <div>Mock sign in</div>;
}

export function SignUp() {
  return <div>Mock sign up</div>;
}

export function useAuth() {
  return {
    isLoaded: true,
    isSignedIn: true,
    userId: mockUser.id,
    getToken: async () => "test-session-token",
  };
}

export function useClerk() {
  return mockClerk;
}

export function useSignUp() {
  return { isLoaded: true, signUp: {}, setActive: async () => undefined };
}

export function useUser() {
  return { isLoaded: true, isSignedIn: true, user: mockUser };
}

export function publishableKeyFromHost() {
  return "pk_test_mwedi_browser_suite";
}
