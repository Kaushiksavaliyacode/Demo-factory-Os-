
export const GOOGLE_SCRIPT_CODE = `
/* 
   factoryOs Data Sync v1.4 (Plant Planning Support)
   ----------------------------------
   - Mirrored architecture for all app modules
   - Automatic sheet creation and header formatting
*/

function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Lock Timeout" }));
  }

  try {
    var data = JSON.parse(e.postData.contents);
    var output = { success: true, message: "" };

    if (data.type === 'SETUP_DASHBOARD') {
      setupHeaders();
      output.message = "All Sheets Initialized";
    }
    else if (data.type === 'JOB' || data.type === 'DELETE_JOB') syncProduction(data);
    else if (data.type === 'BILL' || data.type === 'DELETE_BILL') syncBilling(data);
    else if (data.type === 'SLITTING_JOB' || data.type === 'DELETE_SLITTING_JOB') syncSlitting(data);
    else if (data.type === 'PLAN' || data.type === 'DELETE_PLAN') syncPlanning(data);
    else if (data.type === 'PLANT_PLAN' || data.type === 'DELETE_PLANT_PLAN') syncPlantPlanning(data);
    else if (data.type === 'CHEMICAL_LOG' || data.type === 'DELETE_CHEMICAL_LOG') syncChemicalLog(data);
    else if (data.type === 'CHEMICAL_PURCHASE' || data.type === 'DELETE_CHEMICAL_PURCHASE') syncChemicalPurchase(data);
    else if (data.type === 'CHEMICAL_STOCK') syncChemicalStock(data);

    return ContentService.createTextOutput(JSON.stringify(output));
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }));
  } finally {
    lock.releaseLock();
  }
}
// Rest of the script...
`;