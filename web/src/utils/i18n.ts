//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import { TFunction } from 'i18next';

/**
 * Translate common error messages from backend to localized text.
 * @param msg - The error message from backend
 * @param t - The translation function from useTranslation hook
 * @returns Translated message or original message if no translation found
 */
export const translateErrorMessage = (
  msg: string | undefined | null,
  t: TFunction
): string | undefined => {
  if (!msg) return undefined;
  
  const errorMap: Record<string, string> = {
    // Common errors
    'Request failed': t('error.requestFailed'),
    'Network Error': t('error.networkError'),
    'Network error': t('error.networkError'),
    'Server error': t('error.serverError'),
    'timeout': t('error.timeout'),
    'Timeout': t('error.timeout'),
    // Backend specific messages
    'RAGFlow URL is required': t('error.ragflowUrlRequired'),
    'API Key is required': t('error.apiKeyRequired'),
    'Cannot connect to RAGFlow server': t('error.cannotConnect'),
    'Connection timeout': t('error.connectionTimeout'),
    'Configuration saved successfully': t('error.configSaved'),
    'Failed to save configuration': t('error.configSaveFailed'),
    'name is required': t('error.nameRequired'),
    'ids is required': t('error.idsRequired'),
    'RAGFlow connection not configured': t('error.ragflowNotConfigured'),
    // Auth messages
    'Username is required': t('error.usernameRequired'),
    'Password is required': t('error.passwordRequired'),
    'Invalid username or password': t('error.invalidCredentials'),
    'Authentication required': t('error.authRequired'),
  };
  
  // Exact match first
  if (errorMap[msg]) {
    return errorMap[msg];
  }
  
  // Check for partial matches
  for (const [key, value] of Object.entries(errorMap)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return msg;
};
