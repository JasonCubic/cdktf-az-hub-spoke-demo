# Azure Dev Environment Using Typescript Terraform Cloud Development Kit

I have built the same simple dev environment 2 previous times.  It is just a simple VM in Azure that can be ssh'd into.

- Using normal Terraform: <https://github.com/JasonCubic/tf-dev-env>
- Using CDKTF with none of the stack or construct stuff: <https://github.com/JasonCubic/cdktf-az-dev-env>

I have decided for this demo to keep what is being built simple to lower any potential sources of confusion.

---

- docs here: <https://developer.hashicorp.com/terraform/cdktf>
- cdktf repo here: <https://github.com/hashicorp/terraform-cdk>
- cdktf azurerm provider repo here: <https://github.com/cdktf/cdktf-provider-azurerm>
- typescript cdktf azure example: <https://github.com/hashicorp/terraform-cdk/tree/main/examples/typescript/azure>

The cdktf is infrastructure as software (IaS) that generates terraform infrastructure as code (IaC) JSON.  This provides the ability to abstract the terraform out into building blocks so that you get the declarative benefits of IaC and the programmatic benefits of software composure.

When working in CDKTF I have found it helpful to remember that I am not building Infrastructure.  I am building IaS that will build Terraform IaC, and the IaC will build the infrastructure.  I feel like this mental model has helped.  cdktf code written is for `cdktf synth` all other cdktf cli options such as plan and apply are just proxies for the normal terraform commands.

---

## What is the Cloud Development Kit for Terraform (CDKTF)?

- Basically, AWS built its own knock-off version of Pulumi and called it AWS CDK.  Terraform copied AWS and built CDKTF.
- CDKTF is infrastructure as software (IaS), IaS is another layer of abstraction in front of IaC.  IaS produces IaC.  This is beneficial to keep conditionals and loops out of terraform HCL.  It keeps the terraform HCL files smaller and simpler.
  - The CDKTF produces Terraform JSON that could be used with normal Terraform tools.  such as terraform plan and apply.  Or third-party Terraform security scanners and linters.

## What are the benefits of using CDKTF?

- A platform’s target audience is developers.  The best way to collaborate with developers is GitHub.
  - InnerSource!  GitHub Issues for feature requests and bug reports
- can make cleaner code that terraform alone can do
- You can unit test CDKTF: <https://developer.hashicorp.com/terraform/cdktf/test/unit-tests>
- It produces normal Terraform json that can be run using the Terraform CLI
  - You can use normal Terraform linters in a ci/cd pipeline, like: <https://github.com/terraform-linters/tflint-ruleset-azurerm>

---

## Some CDKTF Glossary terms to understand

### Module

- A module is a Terraform module.  As seen here: <https://registry.terraform.io/browse/modules>
- You can wrap Terraform Modules and use them as constructs with this library: <https://github.com/cdktf/cdktf-tf-module-stack>
- Think of Modules are being a part of the IaC world and CDKTF operates in the IaS world.  Constructs are a better solution for working with CDKTF.

### Stack

A stack is able to be independently deployed and each stack has it's own .tfstate file.  Think of a stack as a normal Terraform project workspace.  CDKTF supports having multiple stacks and each one can deploy something different.  For example you could have three stacks with one Azure subscription each and one stack that deploys to an AWS instance.

### Construct

- A construct is like a Lego.  The smallest piece in the system is a construct, and a collection of constructs is also a construct.
  - Think of constructs as the best way to break up individual pieces of the system to make them reusable.
- Constructs are not unique to CDKTF, It is an industry term:  <https://constructs.dev/>
- You can compile a construct and deploy it to npm (or artifactory) <https://developer.hashicorp.com/terraform/cdktf/develop-custom-constructs/publishing-and-distribution>
  - So we could have people write a construct in C#, Python, Go, or one of the allowed languages then compile and deploy it so anyone could use it in the typescript repo.
    - Why typescript as the parent repo you might wonder.  Nothing forces us to use Typescript as the parent repo.  But CDKTF itself is written in Typescript and it's nice to be able to examine and debug using the source.

---

## How do we do service-now API integration?

We need something like service-now to solve the billing issue.  But the billing issue only needs the subscription id.  So the first signup is done through service now.  We build an api that takes service now calls and generates a pull request (PR) in GitHub with the config setup using the values entered in service-now.  It could also email the person with a link to the PR.

After the first pull request, to add Azure infrastructure and functionality the developers use normal conventional developer collaboration techniques.  Developers submit pull requests with proposed changes to their Azure environment.

## How do we do drift detection using this solution?

- It depends on how we want to set it up.  CDKTF compiles to normal Terraform and that gives us a number of Diff options we can take advantage of.
  - There are ways to do a diff on specific resources in Terraform.
- We can still use other strategies such as azure policies on management groups or some kind of Azure events/functions

## How do we do self-healing?

- It depends on how we want to set it up.  CDKTF compiles to normal Terraform and that gives us a number of options we can take advantage of.  For example, we can destroy and replace a specific resources like this:
  - `terraform apply -replace <one of the resources>` - will destroy and re-apply the resource
- We can still use other strategies such as azure policies on management groups or some kind of Azure events/functions
- We could start by triggering self-healing manually at first

## How do we deploy to azure?

- GitHub actions.  Terraform discusses how to use OIDC and GitHub actions here: <https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/guides/service_principal_oidc>
  - A little more info about this here: <https://learn.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal>
  - and here: <https://developer.hashicorp.com/terraform/cdktf/create-and-deploy/deployment-patterns#terraform-cdk-github-action>
- We have lots of options
  - We could have a separate workflow file for each stack so that a global apply is never done.
  - Each stack could have its own GitHub Environment so we have an easy to follow deployment history.  This would also allow for different Azure credentials if we want to do that.
  - We could auto deploy stacks that have changed after a pull request is merged.
  - We can add in ci/cd tests for external things like service now details or azure states.
  - We can run Terraform plan to validate the terraform configuration
  - We can use Terraform linters

---

Some advice I heard on a podcast to make the cdktf as beneficial as possible is to use the normal Terraform paradigms that have been proven to work for all sizes of infrastructure.  These include:

- keep a flat file structure
- stay very declarative
- keep things as simple as possible
- only add abstractions when needed
- keep following this pattern until you can’t or have a good reason not to

---

## cdktf commands

- `cdktf --version` - get the version
- `cdktf --help` - get help with most commands and see what options are available
- `cdktf init` - used to start a new cdktf project from a template
- `cdktf provider add <provider...>` - Add one or more Terraform providers to your project.  Don't add a provider manually.
- `cdktf get` - Generate CDK Constructs for Terraform providers and modules.
- `cdktf convert` command that can convert a terraform HCL file to a cdktf project in the language chosen.  It kind of works, but needs some manual fixing afterward.
- `cdktf synth` - creates a terraform json IaC in the cdktf.out folder by default
- `cdktf list` - lists the stacks that are in the project
- `ckdtf apply [stacks...]` - deploy the given stacks
- `ckdtf destroy [stacks...]` - destroy the given stacks

Terraform commands that cdktf can also do (you could use normal terraform instead if you prefer).

- `cdktf diff` - does a synth and then a diff on it for drift detection
- `cdktf plan` - does a synth and then a play on it to see what changes will be made when an apply is done
- `ckdtf apply` - does a synth and they a terraform apply on it
- `ckdtf destroy` - does a synth and a terraform destroy on it

---

## How to install the Terraform CDK CLI tool

Prerequisites:

- [Terraform CLI](https://developer.hashicorp.com/terraform/tutorials/aws-get-started/install-cli)
- [Nodejs](https://nodejs.org/en/)

Install Instrucstions:

- You can then install CDKTF from the command line: `npm install --global cdktf-cli`
- To verify it is installed run: `cdktf --help` and/or `cdktf --version`

More info here: <https://developer.hashicorp.com/terraform/tutorials/cdktf/cdktf-install>

---

## How to update Terraform CDK

- To see if you have any outdated npm globally installed packages: `npm outdated -g --depth=0`
- To update CDKTF if it outdated: `npm update -g cdktf-cli`

note:

- You can check to see what version you have by running: `cdktf --version`
- You can see what version is the latest here: <https://www.npmjs.com/package/cdktf-cli?activeTab=versions>

---

## how the ssh keypair that is used in this demo was made

1. `ssh-keygen -t rsa`
2. save to `C:\Users\<your home account>\.ssh\mtcazurekey`
3. skipped passphrase
4. to verify the files `mtcazurekey` and `mtcazurekey.pub` were created, run: `ls -al ~/.ssh`

---

## to import state into cdk

1. cd into the cdktf.out stack folder in question: `cd ./cdktf.out/stacks/rename-hub-subscription`
2. import the state like normal: `terraform import azurerm_subscription.rename-hub-subscription /providers/Microsoft.Subscription/aliases/f06bf1c6-0ab8-
4340-afb6-f7a5f510008c`
3. You will have to copy and paste the tfvars values in
4. If the import succeeded then the state should appear in the correct place for CDKTF

---

docker run --rm -it -v "./cdktf.out/stacks/single-sub-hub-and-spoke:/data" ghcr.io/terraform-linters/tflint-bundle --enable-plugin=azurerm
