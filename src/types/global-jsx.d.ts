// Provide a minimal JSX namespace if React types are not yet picked up
// This file helps TypeScript find the JSX namespace while migrating.

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
