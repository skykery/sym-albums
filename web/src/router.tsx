import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Wizard } from './pages/Wizard';
import { Albums } from './pages/Albums';
import { AlbumEdit } from './pages/AlbumEdit';
import { Settings } from './pages/Settings';
import { RootGate } from './components/RootGate';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootGate />,
    children: [
      { index: true, element: <Navigate to="/albums" replace /> },
      {
        element: <AppShell />,
        children: [
          { path: 'albums', element: <Albums /> },
          { path: 'albums/new', element: <AlbumEdit /> },
          { path: 'albums/:id', element: <AlbumEdit /> },
          { path: 'settings', element: <Settings /> },
        ],
      },
      { path: 'setup', element: <Wizard /> },
    ],
  },
]);
