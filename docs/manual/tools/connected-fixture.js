async ([fixturePath, root]) => {
      const {fileService} = await import(root+'services/file.service.ts');
      const {usbInstance} = await import(root+'services/usb.service.ts');
      const {keyboardService} = await import(root+'services/keyboard.service.ts');
      const {qmkService} = await import(root+'services/qmk.service.ts');
      const {customValueService} = await import(root+'services/custom-value.service.ts');
      const {keyService} = await import(root+'services/key.service.ts');
      const {svalService} = await import(root+'services/sval.service.ts');
      const {SVALBOARD_POINTING_MENU} = await import(root+'@fs'+(fixturePath.startsWith('/')?'':'/')+fixturePath);
      const content = await (await fetch(root+'default-layouts/sval-default.svil')).text();
      const fixture = await fileService.loadFile(new File([content], 'controlled-example.svil'));
      fixture.name = 'test board'; fixture.svil_proto = 3;
      fixture.macros_size = 4096; // a controlled macro buffer, so imports and restores can be checked
      fixture.menus = SVALBOARD_POINTING_MENU;
      fixture.settings = Object.fromEntries(Array.from({length:29}, (_,i)=>[i+1,0]).filter(([i])=>i!==8));
      Object.assign(fixture.settings, {1:200,2:50,4:5000,7:200,19:80,20:5,25:200,28:300});
      fixture.custom_values = customValueService.extractAllItemsWithRefs(fixture.menus).map(({ref}) => ({...ref, data:[({id_left_dpi:3,id_right_dpi:3,id_automouse_timeout:3,id_automouse_threshold:100,id_automouse_decay:10,id_left_automouse:1,id_right_automouse:1})[ref.key] || 0]}));
      svalService.setupCosmeticLayerNames(fixture); keyService.generateAllKeycodes(fixture);
      // Board identity (name and USB serial) for features keyed by board, such as backups.
      const {identityService} = await import(root+'services/identity.service.ts');
      identityService.getInfo = async () => ({available:true, name:'test board', nameMaxBytes:16, serialSource:1, serial:'sval:0123456789ABCDEF'});
      usbInstance.open = async () => true;
      usbInstance.close = async () => {};
      usbInstance.getDeviceName = () => 'test board';
      usbInstance.getAllLayerColors = async () => [];
      usbInstance.send = usbInstance.sendSvil = async () => {throw new Error('Unmocked HID command blocked');};
      keyboardService.init = async () => {};
      keyboardService.load = async () => structuredClone(fixture);
      keyboardService.getActiveLayerIndex = async () => 0;
      qmkService.get = async (keyboard) => {keyboard.settings = {...fixture.settings};};
      customValueService.loadAllMenuValues = async () => structuredClone(fixture.custom_values);
      window.documentationFixture = {source:'bundled QWERTY + pointing-menu test fixture', realHID:false};
    }