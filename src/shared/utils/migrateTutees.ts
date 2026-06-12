import { tuteeService } from '@/features/tutees/services/tuteeService';
import { Tutee, ScheduleItem } from '@/features/tutees/types/tutee';

/**
 * Migration utility to convert old tutee format to new format
 *
 * Old format:
 * - name (string)
 * - phone (string)
 * - schedule (string)
 *
 * New format:
 * - firstName (string)
 * - surname (string)
 * - guardianNumber (string)
 * - schedule (ScheduleItem[])
 */

interface OldTutee {
  id: string;
  name?: string;
  phone?: string;
  schedule?: string;
  [key: string]: any;
}

export async function migrateTuteesToNewFormat(): Promise<void> {
  try {
    console.log('Starting tutee migration...');

    const tutees = await tuteeService.getAll();
    let migratedCount = 0;
    let skippedCount = 0;

    for (const tutee of tutees as any[]) {
      let needsUpdate = false;
      const updates: Partial<Tutee> = {};

      // Check if tutee has old 'name' field
      if (tutee.name && (!tutee.firstName || !tutee.surname)) {
        const nameParts = tutee.name.trim().split(' ');
        updates.firstName = nameParts[0] || '';
        updates.surname = nameParts.slice(1).join(' ') || nameParts[0] || '';
        needsUpdate = true;
        console.log(`Migrating name: ${tutee.name} -> ${updates.firstName} ${updates.surname}`);
      }

      // Check if tutee has old 'phone' field
      if (tutee.phone && !tutee.guardianNumber) {
        updates.guardianNumber = tutee.phone;
        needsUpdate = true;
        console.log(`Migrating phone -> guardianNumber: ${tutee.phone}`);
      }

      // Check if schedule is a string
      if (typeof tutee.schedule === 'string' && tutee.schedule) {
        // Try to parse common schedule formats
        updates.schedule = parseScheduleString(tutee.schedule);
        needsUpdate = true;
        console.log(`Migrating schedule: ${tutee.schedule} -> ${JSON.stringify(updates.schedule)}`);
      }
      // Check if schedule is array but has old format (with 'time' instead of 'startTime'/'endTime')
      else if (Array.isArray(tutee.schedule) && tutee.schedule.length > 0) {
        const firstItem = tutee.schedule[0];
        if ('time' in firstItem && !('startTime' in firstItem)) {
          updates.schedule = tutee.schedule.map((item: any) => {
            const startTime = item.time || '09:00';
            const endTimeHour = parseInt(startTime.split(':')[0]) + 1;
            const endTime = `${endTimeHour.toString().padStart(2, '0')}:${startTime.split(':')[1] || '00'}`;
            return {
              day: item.day,
              startTime,
              endTime,
            };
          });
          needsUpdate = true;
          console.log(`Migrating schedule format: old time -> startTime/endTime`);
        }
      }

      if (needsUpdate) {
        await tuteeService.update(tutee.id, updates);
        migratedCount++;
        console.log(`✓ Migrated tutee: ${tutee.id}`);
      } else {
        skippedCount++;
      }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Migrated: ${migratedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Total: ${tutees.length}`);
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

function parseScheduleString(scheduleStr: string): ScheduleItem[] {
  // Try to parse common formats like "Mon, Wed 4:00 PM" or "Monday 2:00pm, Friday 3:00pm"
  const schedule: ScheduleItem[] = [];

  // Common day abbreviations mapping
  const dayMap: { [key: string]: string } = {
    'mon': 'Monday',
    'tue': 'Tuesday',
    'wed': 'Wednesday',
    'thu': 'Thursday',
    'fri': 'Friday',
    'sat': 'Saturday',
    'sun': 'Sunday',
  };

  // Split by common delimiters
  const parts = scheduleStr.split(/[,;]/).map(s => s.trim());

  for (const part of parts) {
    // Try to extract day and time
    const words = part.split(/\s+/);
    let day = '';
    let time = '';

    for (const word of words) {
      const lowerWord = word.toLowerCase();

      // Check if it's a day
      if (Object.keys(dayMap).some(abbr => lowerWord.startsWith(abbr))) {
        day = dayMap[Object.keys(dayMap).find(abbr => lowerWord.startsWith(abbr))!] || word;
      } else if (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].some(d => lowerWord.includes(d))) {
        day = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }

      // Check if it's a time (contains : or am/pm)
      if (word.includes(':') || lowerWord.includes('am') || lowerWord.includes('pm')) {
        time = word;
      }
    }

    if (day) {
      const startTime = time || '09:00';
      // Default 1 hour duration
      const endTimeHour = parseInt(startTime.split(':')[0]) + 1;
      const endTime = `${endTimeHour.toString().padStart(2, '0')}:${startTime.split(':')[1] || '00'}`;

      schedule.push({
        day: day,
        startTime,
        endTime,
      });
    }
  }

  // If parsing failed, create a default schedule
  if (schedule.length === 0) {
    schedule.push({
      day: 'Monday',
      startTime: '09:00',
      endTime: '10:00',
    });
  }

  return schedule;
}

// For manual migration via browser console
if (typeof window !== 'undefined') {
  (window as any).migrateTutees = migrateTuteesToNewFormat;
}
