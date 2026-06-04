/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('@react-native-firebase/app', () => ({
  __esModule: true,
  getApp: jest.fn(() => ({})),
}));

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  getAuth: jest.fn(() => ({
    onAuthStateChanged: jest.fn(() => jest.fn()),
  })),
  onAuthStateChanged: jest.fn(() => jest.fn()),
  FirebaseAuthTypes: {},
  default: jest.fn(),
}));

jest.mock('@react-native-firebase/database', () => {
  const refMock = {
    on: jest.fn(),
    off: jest.fn(),
  };

  return {
    __esModule: true,
    default: jest.fn(() => ({
      ref: jest.fn(() => refMock),
    })),
  };
});

jest.mock('react-native-video', () => 'Video');
jest.mock('../src/screens/AuthScreen', () => 'AuthScreen');
jest.mock('../src/screens/MainContainer', () => 'MainContainer');

import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
