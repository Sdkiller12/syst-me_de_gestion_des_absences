export interface SmsProviderResponse {
  success: boolean;
  providerMessageId?: string;
  errorMessage?: string;
}

export interface SmsProvider {
  sendSms(phone: string, message: string): Promise<SmsProviderResponse>;
}
