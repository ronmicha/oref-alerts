import type { AlarmHistoryItem } from '@/types/oref'

export const alertHistory: AlarmHistoryItem[] = [
  {
    data: 'תל אביב - מרכז העיר',
    date: '01/03/2026',
    time: '10:00:00',
    alertDate: '2026-03-01T10:00:00',
    category: 1,
    category_desc: 'ירי רקטות וטילים',
    matrix_id: 1,
    rid: 1001,
  },
  {
    data: 'ירושלים',
    date: '01/03/2026',
    time: '11:30:00',
    alertDate: '2026-03-01T11:30:00',
    category: 2,
    category_desc: 'חדירת כלי טיס עוין',
    matrix_id: 6,
    rid: 1002,
  },
  {
    data: 'תל אביב - מרכז העיר',
    date: '02/03/2026',
    time: '08:15:00',
    alertDate: '2026-03-02T08:15:00',
    category: 2,
    category_desc: 'חדירת כלי טיס עוין',
    matrix_id: 6,
    rid: 1003,
  },
  {
    data: 'ירושלים',
    date: '02/03/2026',
    time: '14:45:00',
    alertDate: '2026-03-02T14:45:00',
    category: 1,
    category_desc: 'ירי רקטות וטילים',
    matrix_id: 1,
    rid: 1004,
  },
]
