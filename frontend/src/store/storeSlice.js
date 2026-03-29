import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';

export const fetchStores = createAsyncThunk(
  'stores/fetchStores',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/api/stores');
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch stores');
    }
  }
);

export const fetchStoreMetrics = createAsyncThunk(
  'stores/fetchStoreMetrics',
  async ({ storeId, from, to }, { rejectWithValue }) => {
    try {
      const { data } = await api.get(
        `/api/stores/${storeId}/metrics?from=${from}&to=${to}`
      );
      return { storeId, metrics: data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch metrics');
    }
  }
);

const storeSlice = createSlice({
  name: 'stores',
  initialState: {
    stores: [],
    metrics: {}, // { [storeId]: { current, previous, deltas } }
    selectedStoreId: null,
    loading: false,
    error: null,
  },
  reducers: {
    selectStore(state, action) {
      state.selectedStoreId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStores.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStores.fulfilled, (state, action) => {
        state.loading = false;
        state.stores = action.payload;
      })
      .addCase(fetchStores.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchStoreMetrics.fulfilled, (state, action) => {
        const { storeId, metrics } = action.payload;
        state.metrics[storeId] = metrics;
      });
  },
});

export const { selectStore } = storeSlice.actions;
export default storeSlice.reducer;
