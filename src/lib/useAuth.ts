export type AppUser = {
  name: string;
  role: "operator" | "manager";
};

export function useAuth() {
  return {
    user: {
      name: "Demo User",
      role: "operator",
    } as AppUser,
    isAuthenticated: true,
  };
}