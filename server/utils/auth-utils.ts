
export class AuthUtils {
  static validateSession(sessionData: any): boolean {
    return sessionData && sessionData.userId && sessionData.role;
  }

  static formatUserData(user: any) {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      avatarColor: user.avatarColor
    };
  }

  static checkPermissions(userRole: string, requiredRole: string): boolean {
    const roleHierarchy = ['intern', 'observer', 'analyst', 'partner', 'admin'];
    const userLevel = roleHierarchy.indexOf(userRole);
    const requiredLevel = roleHierarchy.indexOf(requiredRole);
    return userLevel >= requiredLevel;
  }
}