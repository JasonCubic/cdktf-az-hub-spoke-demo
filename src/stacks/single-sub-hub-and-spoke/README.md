# How to verify the Hub and Spoke are working

Get the IP address of the VM in the mock on-prem network and ssh to it `ssh <adminUser>@123.123.123.123`

Try to ping the other VM's

- VM in the hub VNet: `ping 10.0.0.68`
- VM in the dmz: `ping 10.0.0.36`
- spoke 1: `ping 10.1.0.68`
- spoke 2: `ping 10.2.0.68`

You can also ssh into each of the above vm's from the on-prem vm

from each vm you can try to ping the others and also test access to the internet using curl

`curl http://example.org`

Note: the spokes should not have access to the internet

More info here: <https://learn.microsoft.com/en-us/azure/developer/terraform/hub-spoke-validation#6-verify-the-results>
