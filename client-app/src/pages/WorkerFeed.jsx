import CivicFeed from './CivicFeed';

// Worker Feed — can like/comment but cannot post new issues
export default function WorkerFeed({ onBack }) {
  return <CivicFeed onBack={onBack} readOnly={false} />;
}
