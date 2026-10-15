"use client";

import PricePlanCard from '../common/PricePlanCard';
import { SUBSCRIPTIONS } from '../../constants/subscriptions';

const SubscriptionSection = () => {
  return (
    <section id="pricing" className="pt-16 pb-32 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
           {SUBSCRIPTIONS.map((plan, index) => (
             <PricePlanCard 
               key={index} 
               index={index}
               /* Assicurati che PricePlanCard gestisca internamente 
                  la variante 'light' per cambiare i suoi colori interni 
               */
               variant='light'
               {...plan} 
             />
           ))}
        </div>
      </div>
    </section>
  );
};

export default SubscriptionSection;