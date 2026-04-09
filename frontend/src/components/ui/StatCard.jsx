// CourseIntellect Stat Card Component
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from './card';
import { cn } from '../../lib/utils';

// Count Up Animation Hook
function useCountUp(end, duration = 1000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime;
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [end, duration]);

  return count;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  color = '#00354F',
  suffix = '',
  prefix = '',
  className,
}) {
  const displayValue = useCountUp(value);

  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={cn('group', className)}
    >
      <Card 
        className="relative overflow-hidden hover:shadow-card-hover transition-all duration-300 border-l-4"
        style={{ borderLeftColor: color }}
      >
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">{title}</p>
              <p className="text-3xl font-bold mt-2 font-heading">
                {prefix}{displayValue.toLocaleString()}{suffix}
              </p>
              {(trend || trendValue) && (
                <div className="flex items-center gap-1 mt-2">
                  {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                  {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
                  {trendValue && (
                    <span className={cn(
                      'text-sm',
                      trend === 'up' ? 'text-green-500' : 'text-red-500'
                    )}>
                      {trendValue}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div 
              className="p-3 rounded-xl transition-colors"
              style={{ backgroundColor: `${color}15` }}
            >
              <Icon className="h-6 w-6" style={{ color }} />
            </div>
          </div>
        </CardContent>
        
        {/* Hover effect bar */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-1 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"
          style={{ backgroundColor: color }}
        />
      </Card>
    </motion.div>
  );
}

// Mini Stat Card variant
export function MiniStatCard({
  title,
  value,
  icon: Icon,
  color = '#00354F',
  className,
}) {
  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div 
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${color}15` }}
          >
            <Icon className="h-4 w-4" style={{ color }} />
          </div>
          <div>
            <p className="text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{title}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default StatCard;
