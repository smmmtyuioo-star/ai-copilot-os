class SessionManager {
  private static instance: SessionManager;
  private storageKey: string = 'copilot_session';

  private constructor() {}

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  public saveSession(sessionData: any): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  public loadSession(): any {
    try {
      const sessionData = localStorage.getItem(this.storageKey);
      return sessionData ? JSON.parse(sessionData) : null;
    } catch (error) {
      console.error('Failed to load session:', error);
      return null;
    }
  }
}

export default SessionManager;
