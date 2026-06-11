// Mock auth service - placeholder for Firebase implementation
export const authService = {
  // These will be implemented when Firebase is connected
  login: async (email: string, password: string) => {
    console.log('Login:', email, password);
  },
  signup: async (email: string, password: string, name: string) => {
    console.log('Signup:', email, password, name);
  },
  logout: async () => {
    console.log('Logout');
  },
  resetPassword: async (email: string) => {
    console.log('Reset password:', email);
  },
};
