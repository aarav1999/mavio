import { Suspense } from 'react';
import ErrorContent from './ErrorContent';

export default function AuthError() {
  return (
    <Suspense fallback={null}>
      <ErrorContent />
    </Suspense>
  );
}
