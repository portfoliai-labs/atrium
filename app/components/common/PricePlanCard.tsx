import { Check, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

interface PricePlanCardProps {
  title: string;
  price: string;
  features: string[];
  ctaText: string;
  popular: boolean;
  index: number;
  available: boolean;
  onAction?: () => void;
  variant?: 'dark' | 'light'; // <--- Nuova prop
}

const PricePlanCard: React.FC<PricePlanCardProps> = ({ 
  title, 
  price, 
  features, 
  ctaText, 
  popular, 
  index, 
  available, 
  onAction,
  variant = 'dark'
}) => {
  const isDark = variant === 'dark';

  // Logica dei colori dinamica
  const styles = {
    container: isDark 
      ? 'bg-slate-900 border-slate-800' 
      : 'bg-white border-slate-200 shadow-sm',
    title: isDark 
      ? (available ? 'text-white' : 'text-slate-400') 
      : (available ? 'text-slate-900' : 'text-slate-400'),
    price: isDark 
      ? (available ? 'text-white' : 'text-slate-500') 
      : (available ? 'text-slate-900' : 'text-slate-500'),
    featureText: isDark 
      ? (available ? 'text-slate-300' : 'text-slate-500') 
      : (available ? 'text-slate-600' : 'text-slate-400'),
    checkBg: isDark 
      ? (available ? 'bg-cyan-900/50' : 'bg-slate-800') 
      : (available ? 'bg-cyan-100' : 'bg-slate-100'),
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 30 }}
      whileInView={{ 
        opacity: available ? 1 : 0.6, 
        scale: (popular && available) ? 1.05 : 1, 
        y: 0 
      }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className={`${styles.container} p-10 rounded-[2.5rem] border transition-all flex flex-col gap-8 relative ${
        popular && available && 'border-cyan-500 shadow-xl'
      } ${!available && 'grayscale-[0.5]'}`}
    >
      {/* Badge Popular / Lock */}
      {popular && available && (
          <div className="absolute top-0 right-10 -translate-y-1/2 bg-cyan-500 text-slate-950 px-4 py-1 rounded-full text-xs font-bold tracking-wider uppercase">
              Most Popular
          </div>
      )}
      
      {!available && (
          <div className="absolute top-0 right-10 -translate-y-1/2 bg-slate-700 text-slate-300 px-4 py-1 rounded-full text-xs font-bold tracking-wider uppercase flex items-center gap-1">
              <Lock className="w-3 h-3" /> Soon
          </div>
      )}

      <div>
        <h3 className={`text-2xl font-bold mb-2 ${styles.title}`}>{title}</h3>
        <div className="flex items-baseline gap-1 mb-2">
          <p className={`text-5xl font-extrabold ${styles.price}`}>{price}</p>
          {available && !['Free', 'Custom'].includes(price) && (
            <span className="text-slate-500 font-medium">/month</span>
          )}
        </div>
      </div>

      <ul className="space-y-4 flex-grow">
        {features.map(feature => (
          <li key={feature} className={`flex items-center gap-3 text-sm font-medium ${styles.featureText}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${styles.checkBg}`}>
               <Check className={`w-3 h-3 ${available ? 'text-cyan-500' : 'text-slate-400'}`} />
            </div>
            {feature}
          </li>
        ))}
      </ul>

      <button 
        onClick={available ? onAction : undefined}
        disabled={!available}
        className={`w-full py-4 rounded-2xl font-bold transition-all transform active:scale-95 ${
          !available 
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
            : popular 
              ? 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-lg shadow-cyan-900/20' 
              : isDark ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
        }`}
      >
        {available ? ctaText : 'Coming Soon'}
      </button>
    </motion.div>
  );
};

export default PricePlanCard;