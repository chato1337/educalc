/**
 * Registers only the Chart.js pieces needed for dashboard KPI charts (smaller bundle).
 */
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
)
