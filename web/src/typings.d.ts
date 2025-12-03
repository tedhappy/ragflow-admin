//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

// Type declarations for CSS/Less modules
declare module '*.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.less' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// Type declarations for image files
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.svg';

// Umi exports augmentation
declare module 'umi' {
  export const Outlet: React.FC;
  export const Link: React.FC<{
    to: string;
    children?: React.ReactNode;
    [key: string]: any;
  }>;
  export function useLocation(): {
    pathname: string;
    search: string;
    hash: string;
    state: any;
  };
  export function useNavigate(): (to: string, options?: any) => void;
  export const history: {
    push: (path: string, state?: any) => void;
    replace: (path: string, state?: any) => void;
    go: (n: number) => void;
    goBack: () => void;
    goForward: () => void;
  };
}
