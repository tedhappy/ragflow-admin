//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import { TFunction } from 'i18next';

export const translateErrorMessage = (
  msg: string | undefined | null,
  t: TFunction
): string | undefined => {
  if (!msg) return undefined;
  
  const errorMap: Record<string, string> = {
    'Request failed': t('error.requestFailed'),
    'Network Error': t('error.networkError'),
    'Network error': t('error.networkError'),
    'Server error': t('error.serverError'),
    'timeout': t('error.timeout'),
    'Timeout': t('error.timeout'),
    'RAGFlow URL is required': t('error.ragflowUrlRequired'),
    'API Key is required': t('error.apiKeyRequired'),
    'Cannot connect to RAGFlow server': t('error.cannotConnect'),
    'Connection timeout': t('error.connectionTimeout'),
    'Configuration saved successfully': t('error.configSaved'),
    'Failed to save configuration': t('error.configSaveFailed'),
    'name is required': t('error.nameRequired'),
    'ids is required': t('error.idsRequired'),
    'RAGFlow connection not configured': t('error.ragflowNotConfigured'),
    'Username is required': t('error.usernameRequired'),
    'Password is required': t('error.passwordRequired'),
    'Invalid username or password': t('error.invalidCredentials'),
    'Authentication required': t('error.authRequired'),
  };
  
  if (errorMap[msg]) {
    return errorMap[msg];
  }
  
  for (const [key, value] of Object.entries(errorMap)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return msg;
};
