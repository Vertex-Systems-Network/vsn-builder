import db from "../db.server.js";

function daysAgo(days) { return new Date(Date.now() - days * 24 * 60 * 60 * 1000); }

export async function cleanupBuilderData(shop, options = {}) {
  const revisionDays = Number(options.revisionDays || 90);
  const logDays = Number(options.logDays || 30);
  const diagnosticDays = Number(options.diagnosticDays || 30);
  const auditDays = Number(options.auditDays || 180);
  const backupDays = Math.max(1, Number(options.backupDays || 30));
  const backupRetentionCount = Math.max(1, Number(options.backupRetentionCount || 20));

  const pages = await db.builderPage.findMany({ where: { shop }, select: { id: true } });
  const pageIds = new Set(pages.map((p) => p.id));
  const revisions = await db.builderRevision.findMany({ where: { shop }, select: { id: true, pageId: true, createdAt: true } });
  const orphanRevisionIds = revisions.filter((r) => !pageIds.has(r.pageId)).map((r) => r.id);

  const expiredSubmissionRows = await db.builderFormSubmission.findMany({ where:{shop,retainedUntil:{lt:new Date()}}, select:{id:true} }).catch(()=>[]);
  const expiredSubmissionIds = expiredSubmissionRows.map((row)=>row.id);
  const protectedBackups = await db.builderBackup.findMany({ where:{shop}, orderBy:{createdAt:"desc"}, take:backupRetentionCount, select:{id:true} }).catch(()=>[]);
  const protectedBackupIds = protectedBackups.map((row)=>row.id);
  const [oldRevisions, orphanRevisions, oldRequests, oldDiagnostics, oldAudits, expiredUploads, expiredAutomationLogs, expiredSubmissions, oldBackups] = await db.$transaction([
    db.builderRevision.deleteMany({ where: { shop, createdAt: { lt: daysAgo(revisionDays) }, kind: { not: "publish" } } }),
    db.builderRevision.deleteMany({ where: { id: { in: orphanRevisionIds } } }),
    db.builderRequestLog.deleteMany({ where: { shop, createdAt: { lt: daysAgo(logDays) } } }),
    db.builderDiagnosticEvent.deleteMany({ where: { shop, createdAt: { lt: daysAgo(diagnosticDays) }, level: { not: "error" } } }),
    db.builderAuditLog.deleteMany({ where: { shop, createdAt: { lt: daysAgo(auditDays) } } }),
    db.builderFormUpload.deleteMany({ where:{shop,submissionId:{in:expiredSubmissionIds}} }),
    db.builderAutomationLog.deleteMany({ where:{shop,submissionId:{in:expiredSubmissionIds}} }),
    db.builderFormSubmission.deleteMany({ where:{shop,id:{in:expiredSubmissionIds}} }),
    db.builderBackup.deleteMany({ where:{shop,createdAt:{lt:daysAgo(backupDays)},id:{notIn:protectedBackupIds}} }),
  ]);

  const stats = { oldRevisions: oldRevisions.count, orphanRevisions: orphanRevisions.count, oldRequests: oldRequests.count, oldDiagnostics: oldDiagnostics.count, oldAudits: oldAudits.count, expiredUploads:expiredUploads.count, expiredAutomationLogs:expiredAutomationLogs.count, expiredSubmissions:expiredSubmissions.count, oldBackups:oldBackups.count };
  await db.builderCleanupRun.create({ data: { shop, statsJson: JSON.stringify(stats) } });
  return stats;
}
