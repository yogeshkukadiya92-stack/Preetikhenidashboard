const clean = (value) => String(value ?? '').trim().toLowerCase();

export function appointmentVisitId(row) {
  return `appointment-${row.slice(0, 5).map((value) => encodeURIComponent(clean(value))).join('-')}`;
}

// Journey visits may use a generated visit ID or an appointment-derived ID.
export function removeAppointmentFromJourneys(journeys, row) {
  const next = { ...journeys };
  for (const [patient, record] of Object.entries(journeys)) {
    if (clean(patient) !== clean(row[0]) || !record) continue;
    const matches = (visit) => visit.id === appointmentVisitId(row)
      || (visit.appointmentData && appointmentVisitId([
        patient, visit.appointmentData.mobile, visit.appointmentData.date ?? visit.visitDate,
        visit.appointmentData.time, visit.appointmentData.type,
      ]) === appointmentVisitId(row));
    const clearFollowup = (visit) => {
      if (clean(row[4]) !== 'follow-up' || !visit.followupData
        || clean(visit.followupData.date) !== clean(row[2])
        || clean(visit.followupData.time) !== clean(row[3])) return visit;
      const { followupData, followupAt, followup, ...rest } = visit;
      return rest;
    };
    if (Array.isArray(record.visits)) {
      const visits = record.visits.filter((visit) => !matches(visit)).map(clearFollowup);
      next[patient] = {
        ...record,
        visits,
        activeVisitId: visits.some((visit) => visit.id === record.activeVisitId)
          ? record.activeVisitId : visits.at(-1)?.id ?? '',
      };
    } else {
      next[patient] = matches(record) ? {} : clearFollowup(record);
    }
  }
  return next;
}
