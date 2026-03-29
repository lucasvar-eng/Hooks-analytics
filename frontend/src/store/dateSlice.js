import { createSlice } from '@reduxjs/toolkit';

function getDefaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6); // Last 7 days
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

const PRESETS = {
  today: () => {
    const d = new Date().toISOString().split('T')[0];
    return { from: d, to: d };
  },
  yesterday: () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const str = d.toISOString().split('T')[0];
    return { from: str, to: str };
  },
  last7: () => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 6);
    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
    };
  },
  last30: () => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 29);
    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
    };
  },
  thisMonth: () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      from: from.toISOString().split('T')[0],
      to: now.toISOString().split('T')[0],
    };
  },
  lastMonth: () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
    };
  },
};

const defaults = getDefaultRange();

const dateSlice = createSlice({
  name: 'date',
  initialState: {
    from: defaults.from,
    to: defaults.to,
    preset: 'last7',
    compareEnabled: false,
  },
  reducers: {
    setPreset(state, action) {
      const presetFn = PRESETS[action.payload];
      if (presetFn) {
        const range = presetFn();
        state.from = range.from;
        state.to = range.to;
        state.preset = action.payload;
      }
    },
    setCustomRange(state, action) {
      state.from = action.payload.from;
      state.to = action.payload.to;
      state.preset = 'custom';
    },
    toggleCompare(state) {
      state.compareEnabled = !state.compareEnabled;
    },
  },
});

export const { setPreset, setCustomRange, toggleCompare } = dateSlice.actions;
export { PRESETS };
export default dateSlice.reducer;
