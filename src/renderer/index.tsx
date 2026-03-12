import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Overlay from './Overlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

if (window.location.hash === '#/overlay') {
    root.render(
        <ErrorBoundary>
            <Overlay />
        </ErrorBoundary>
    );
} else {
    root.render(
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    );
}
