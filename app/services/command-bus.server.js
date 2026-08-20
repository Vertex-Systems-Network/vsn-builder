import crypto from 'node:crypto';

function compact(value, max=1600) {
  const text=JSON.stringify(value ?? null);
  return text.length>max?`${text.slice(0,max)}…`:text;
}

export async function runBuilderCommand(db,{shop,pageId=null,actor='system',role='system',name,input={},execute}) {
  if(!shop) throw new Error('Builder command requires a shop.');
  if(typeof execute!=='function') throw new Error('Builder command requires an execute function.');
  const commandId=crypto.randomUUID();
  const startedAt=Date.now();
  const result=await db.$transaction(async(tx)=>{
    const output=await execute(tx,{commandId});
    await tx.builderAuditLog.create({data:{shop,pageId,actor,role,action:`command.${name}.executed`,details:JSON.stringify({commandId,durationMs:Date.now()-startedAt,input:compact(input,900),undo:output?.undo??null})}});
    return output;
  });
  return {commandId,result,durationMs:Date.now()-startedAt};
}

export async function listRecentBuilderCommands(db,shop,limit=30) {
  const rows=await db.builderAuditLog.findMany({where:{shop,action:{startsWith:'command.'}},orderBy:{createdAt:'desc'},take:Math.max(1,Math.min(100,Number(limit)||30))}).catch(()=>[]);
  return rows.map((row)=>({id:row.id,pageId:row.pageId,actor:row.actor,role:row.role,action:row.action,details:row.details,createdAt:row.createdAt?.toISOString?.()||row.createdAt}));
}
