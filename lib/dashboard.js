const Student = require('../models/Student');
const TrainingSchedule = require('../models/TrainingSchedule');
const Certificate = require('../models/Certificate');
const { io } = require('../server'); // Import io for emitting events

/**
 * Fetches and calculates all data required for the school dashboard.
 * @param {string} schoolId - The ID of the school.
 * @returns {Promise<object>} - A promise that resolves to the dashboard data.
 */
async function getDashboardData(schoolId) {
  const today = new Date();

  // Fetch all necessary data in parallel
  const [students, schedules] = await Promise.all([
    Student.find({ school: schoolId }),
    TrainingSchedule.find({ school: schoolId }),
  ]);

  const studentIds = students.map(student => student._id);
  const certificatesEarned = await Certificate.countDocuments({ recipient: { $in: studentIds } });

  // 1. Total and Active Students
  const totalStudents = students.length;
  const activeStudents = students.filter(student => student.progress > 0).length;

  // 2. Sessions this month
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const sessionsThisMonth = schedules.reduce((count, schedule) => {
    return count + schedule.sessions.filter(session => {
      const sessionDate = new Date(session.date);
      return sessionDate >= startOfMonth && sessionDate <= endOfMonth;
    }).length;
  }, 0);

  // 3. Average Progress
  const totalProgress = students.reduce((sum, student) => sum + student.progress, 0);
  const averageProgress = students.length > 0 ? totalProgress / students.length : 0;

  // 4. Upcoming Sessions
  const upcomingSessions = schedules.flatMap(schedule => {
    return schedule.sessions
      .filter(session => new Date(session.date) > today)
      .map(session => ({
        date: session.date,
        name: session.topic,
      }));
  });

  // 5. Top Performers
  const topPerformers = students
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 5)
    .map(student => ({ name: student.name, progress: student.progress }));

  return {
    totalStudents,
    activeStudents,
    sessionsThisMonth,
    certificatesEarned,
    averageProgress: parseFloat(averageProgress.toFixed(2)),
    upcomingSessions,
    topPerformers,
    students, // Add the full student list for the frontend to render
  };
}

/**
 * Fetches fresh dashboard data and emits it to the specified school's room.
 * @param {string} schoolId - The ID of the school to update.
 */
async function triggerDashboardUpdate(schoolId) {
  if (!schoolId) return;

  try {
    const dashboardData = await getDashboardData(schoolId);
    // Emit the 'dashboardUpdate' event to a room named after the school's ID
    io.to(schoolId.toString()).emit('dashboardUpdate', dashboardData);
  } catch (error) {
    console.error(`Failed to trigger dashboard update for school ${schoolId}:`, error);
  }
}

module.exports = { getDashboardData, triggerDashboardUpdate };