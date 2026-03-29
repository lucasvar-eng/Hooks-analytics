import { useSelector, useDispatch } from 'react-redux';
import { setPreset, setCustomRange } from '../../store/dateSlice';

const PRESET_LABELS = {
  today: 'Hoy',
  yesterday: 'Ayer',
  last7: 'Últimos 7 días',
  last30: 'Últimos 30 días',
  thisMonth: 'Este mes',
  lastMonth: 'Mes pasado',
};

export default function DateRangePicker() {
  const dispatch = useDispatch();
  const { from, to, preset } = useSelector((state) => state.date);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Preset buttons */}
      <div className="flex gap-1">
        {Object.entries(PRESET_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => dispatch(setPreset(key))}
            className={`px-3 py-1.5 text-xs rounded-lg transition font-medium ${
              preset === key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Custom date inputs */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={from}
          onChange={(e) =>
            dispatch(setCustomRange({ from: e.target.value, to }))
          }
          className="px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
        <span className="text-gray-400 text-xs">a</span>
        <input
          type="date"
          value={to}
          onChange={(e) =>
            dispatch(setCustomRange({ from, to: e.target.value }))
          }
          className="px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
      </div>
    </div>
  );
}
