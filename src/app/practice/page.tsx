import { notFound } from 'next/navigation';
import PracticeClient from './PracticeClient';

export default function PracticePage() {
    if (process.env.NODE_ENV !== 'development') {
        notFound();
    }
    return <PracticeClient />;
}
