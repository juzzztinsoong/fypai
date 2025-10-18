// Quick script to seed chime rules
import fetch from 'node:fetch';

async function seedRules() {
  try {
    const response = await fetch('http://localhost:5000/api/chime/rules/seed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ teamId: 'team1' }),
    });

    const data = await response.json();
    console.log('✅ Rules seeded successfully!');
    console.log(`📊 Created ${data.length} rules:\n`);
    
    data.forEach((rule, i) => {
      console.log(`${i + 1}. ${rule.name} (${rule.type}, priority: ${rule.priority})`);
      console.log(`   Enabled: ${rule.enabled}, Cooldown: ${rule.cooldownMinutes}min`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Error seeding rules:', error.message);
  }
}

seedRules();
