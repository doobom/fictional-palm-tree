// frontend/src/components/ScoreTrendChart.tsx
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import service, { ApiResponse } from '../api/request';
import { useTranslation } from 'react-i18next';

interface TrendChartProps {
  childId: string;
}

export default function ScoreTrendChart({ childId }: TrendChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    if (childId) {
      fetchTrend();
    }
  }, [childId]);

  const fetchTrend = async () => {
    setLoading(true);
    try {
      const res = await service.get<any, ApiResponse>(`/analytics/trend?childId=${childId}&days=7`);
      if (res.success) {
        setData(res.data);
      }
    } catch (error) {
      console.error("Failed to fetch trend data", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="h-[250px] flex items-center justify-center text-gray-400 font-bold animate-pulse">{t('common.loading')}</div>;
  }

  // 自定义提示框样式适配暗黑模式
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3 rounded-xl shadow-lg">
          <p className="font-bold text-gray-800 dark:text-gray-200 mb-2">{label}</p>
          <p className="text-blue-500 font-black text-sm">{t('common.earned')}: +{payload[0].value}</p>
          <p className="text-red-400 font-black text-sm">{t('common.spent')}: -{payload[1].value}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-[250px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-gray-200 dark:text-gray-700" />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#9ca3af' }} 
            dy={10} 
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#9ca3af' }} 
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(156, 163, 175, 0.1)' }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
          <Bar dataKey="earned" name={t('common.earned')} fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={30} />
          <Bar dataKey="spent" name={t('common.spent')} fill="#f87171" radius={[4, 4, 0, 0]} maxBarSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}