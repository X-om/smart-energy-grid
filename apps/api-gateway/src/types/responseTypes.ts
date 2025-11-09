export interface IRegisterResponseData {
  userId: string;
  email: string;
  name: string;
  emailVerified: boolean;
  devOTP?: string;
}