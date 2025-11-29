import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Overlay from './Overlay';
import './styles.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

if (window.location.hash === '#/overlay') {
    root.render(<Overlay />);
} else {
    root.render(<App />);
}
