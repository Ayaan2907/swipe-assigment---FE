"use client";

import { PersistGate } from "redux-persist/integration/react";
import { Provider } from "react-redux";
import type { ReactNode } from "react";

import { persistor, store } from "./store";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        {children}
      </PersistGate>
    </Provider>
  );
}
