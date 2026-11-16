import { notFound } from 'next/navigation';
import WatchClient from './WatchClient';

export default function WatchPage() {
    if (process.env.NODE_ENV !== 'development') notFound();
    return <WatchClient />;
}
