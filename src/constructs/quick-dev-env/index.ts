import { Construct } from 'constructs';

// ResourceGroup is a CDKTF provider resource.
// - Typescript linter will tell you if you have typing based misconfiguration
// - You can look through the options in the node_modules folders
// - In vsCode you can goto the definition to see the type definition
import { ResourceGroup } from '@cdktf/provider-azurerm/lib/resource-group/index.js';

// Constructs are like lego's. A construct can be collection of a bunch of other constructs.
// this quick dev environment construct is made up of these two other constructs
import SimpleVNet from '../simple-vnet/index.js';
import SimpleLinuxVm from '../simple-linux-vm/index.js';

class QuickDevEnv extends Construct {
  constructor(scope: Construct, name: string, region: string) {
    super(scope, name);

    const tags = {
      environment: 'dev',
    };

    const myRg = new ResourceGroup(
      this,
      'mtc-rg',
      {
        location: region,
        name: 'mtc-resources',
        tags,
      },
    );

    const myVNet = new SimpleVNet(this, 'simple-vnet', {
      resourceGroup: myRg,
      vNetName: 'mtc-network',
      vNetAddressSpace: ['10.123.0.0/16'],
      subnetAddressPrefixes: ['10.123.1.0/24'],
      tags,
    });

    myVNet.addPublicIp();

    const myLinuxVm = new SimpleLinuxVm(this, 'simple-linux-vm', {
      resourceGroup: myRg,
      adminSshPublicKeyPath: '~/.ssh/mtcazurekey.pub',
      adminSshUsername: 'adminuser',
      adminUsername: 'adminuser',
      tags,
    });

    myLinuxVm.addNicWithPublicIp(myVNet.pip, myVNet.subnet);

    myLinuxVm.addDockerExtension();
    myLinuxVm.addVsCodeRemoteProvisoner('adminuser', '~/.ssh/mtcazurekey');
    myLinuxVm.outputPublicIpData(myVNet.pip);
  }
}

export default QuickDevEnv;
