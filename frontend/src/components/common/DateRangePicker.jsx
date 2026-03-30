import { useSelector, useDispatch } from 'react-redux';
import { setPreset, setCustomRange } from '../../store/dateSlice';

const PRESET_LABELS = {
  today: 'Hoy',
  yesterday: 'Ayer',
  last7: '7d',
  last30: '30d',
  thisMonth: 'Mes',
  lastMonth: 'Mes ant.',
};

export default function DateRangePicker() {
  const dispatch = useDispatch();
  const { from, to, preset } = useSelector((state) => state.date);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Preset buttons */}
      <div className="flex gap-0.5">
        {Object.entries(PRESET_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => dispatch(setPreset(key))}
            className={`px-2.5 py-1 text-[10px] rounded-md transition font-semibold ${
              preset === key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-750 hover:text-gray-700 dark:hover:text-gray-300 border border-transparent dark:border-gray-700/60'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Custom date inputs */}
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={from}
          onChange={(e) =>
            dispatch(setCustomRange({ from: e.target.value, to }))
          }
          className="px-2 py-1 text-[11px] rounded-md border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium"
        />
        <span className="text-gray-400 dark:text-gray-600 text-[10px]">—</span>
        <input
          type="date"
          value={to}
          onChange={(e) =>
            dispatch(setCustomRange({ from, to: e.target.value }))
          }
          className="px-2 py-1 text-[11px] rounded-md border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium"
        />
      </div>
    </div>
  );
}
