declare module 'resend' {
  export interface Resend {
    emails: {
      send(options: {
        from: string;
        to: string[];
        subject: string;
        html?: string;
        text?: string;
      }): Promise<{ 
        id: string; 
        data?: any;
        error?: any;
      }>;
    };
  }
  
  export const Resend: new (apiKey: string) => Resend;
}
