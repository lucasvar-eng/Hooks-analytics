import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import dateReducer from './dateSlice';
import storeReducer from './storeSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    date: dateReducer,
    stores: storeReducer,
  },
});
