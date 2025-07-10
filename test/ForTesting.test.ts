import { expect } from 'chai';
import { ethers } from 'hardhat';

/*
  ForTesting 테스트 리스트 예시
  (아래의 테스트 외에 필요한 테스트를 구현해보시기 바랍니다.)

  - owner 관련
    - 배포시 owner 상태 변경 여부
    - setValue()를 owner만 할 수 있는지
    - withdraw()를 owner만 할 수 있는지
  
  - 함수 검증
    - setValue()를 실행 후 value를 바꾸는지
    - (getter) balances()를 실행 후 balance 값이 나오는지
    - deposit()를 실행 후 보낸 값(value)에 따라 balances를 바꾸는지
    - withdraw()를 실행 후 받을 값(amount)에 따라 balances를 바꾸는지
  
  - 이벤트 검증
    - setValue()를 실행 후 ValueChanged 이벤트가 발생하는지
    - deposit()를 실행 후 Deposited 이벤트가 발생하는지
    - withdraw()를 실행 후 Withdrawn 이벤트가 발생하는지
*/

describe('ForTesting 테스트', function () {
  let contract: any;
  let owner: any;
  let otherAccount: any;
  let thirdAccount: any;

  beforeEach(async function () {
    [owner, otherAccount, thirdAccount] = await ethers.getSigners();
    const ContractFactory = await ethers.getContractFactory('ForTesting');
    contract = await ContractFactory.deploy();
    await contract.waitForDeployment();
  });

  describe('Owner 관련 테스트', function () {
    it('배포시 owner 상태 변경 여부', async function () {
      const contractOwner = await contract.owner();
      expect(contractOwner).to.equal(owner.address);
    });

    it('setValue()를 owner만 할 수 있는지', async function () {
      const newValue = 100;
      
      // owner가 setValue를 호출하면 성공해야 함
      await expect(contract.connect(owner).setValue(newValue))
        .to.not.be.reverted;
      
      // 다른 계정이 setValue를 호출하면 실패해야 함
      await expect(contract.connect(otherAccount).setValue(newValue))
        .to.be.revertedWith('Only owner can call this function');
    });

    it('withdraw()를 owner만 할 수 있는지', async function () {
      // 먼저 deposit을 통해 잔액을 생성
      const depositAmount = ethers.parseEther('1');
      await contract.connect(owner).deposit({ value: depositAmount });
      
      const withdrawAmount = ethers.parseEther('0.5');
      
      // owner가 withdraw를 호출하면 성공해야 함
      await expect(contract.connect(owner).withdraw(withdrawAmount))
        .to.not.be.reverted;
      
      // 다른 계정이 withdraw를 호출하면 실패해야 함
      await expect(contract.connect(otherAccount).withdraw(withdrawAmount))
        .to.be.revertedWith('Only owner can call this function');
    });
  });

  describe('함수 검증 테스트', function () {
    it('setValue()를 실행 후 value를 바꾸는지', async function () {
      const initialValue = await contract.value();
      const newValue = 123;
      
      await contract.connect(owner).setValue(newValue);
      
      const updatedValue = await contract.value();
      expect(updatedValue).to.equal(newValue);
      expect(updatedValue).to.not.equal(initialValue);
    });

    it('(getter) balances()를 실행 후 balance 값이 나오는지', async function () {
      const depositAmount = ethers.parseEther('2');
      await contract.connect(otherAccount).deposit({ value: depositAmount });
      
      const balance = await contract.balances(otherAccount.address);
      expect(balance).to.equal(depositAmount);
    });

    it('deposit()를 실행 후 보낸 값(value)에 따라 balances를 바꾸는지', async function () {
      const initialBalance = await contract.balances(otherAccount.address);
      const depositAmount = ethers.parseEther('1.5');
      
      await contract.connect(otherAccount).deposit({ value: depositAmount });
      
      const newBalance = await contract.balances(otherAccount.address);
      expect(newBalance).to.equal(initialBalance + depositAmount);
    });

    it('withdraw()를 실행 후 받을 값(amount)에 따라 balances를 바꾸는지', async function () {
      // 먼저 deposit
      const depositAmount = ethers.parseEther('2');
      await contract.connect(owner).deposit({ value: depositAmount });
      
      const initialBalance = await contract.balances(owner.address);
      const withdrawAmount = ethers.parseEther('0.8');
      
      await contract.connect(owner).withdraw(withdrawAmount);
      
      const newBalance = await contract.balances(owner.address);
      expect(newBalance).to.equal(initialBalance - withdrawAmount);
    });

    it('deposit()에서 0 이더를 보내면 실패하는지', async function () {
      await expect(contract.connect(otherAccount).deposit({ value: 0 }))
        .to.be.revertedWith('Must send Coins');
    });

    it('withdraw()에서 잔액보다 많은 금액을 출금하려 하면 실패하는지', async function () {
      const depositAmount = ethers.parseEther('1');
      await contract.connect(owner).deposit({ value: depositAmount });
      
      const withdrawAmount = ethers.parseEther('2');
      await expect(contract.connect(owner).withdraw(withdrawAmount))
        .to.be.revertedWith('Insufficient balance');
    });
  });

  describe('이벤트 검증 테스트', function () {
    it('setValue()를 실행 후 ValueChanged 이벤트가 발생하는지', async function () {
      const oldValue = await contract.value();
      const newValue = 456;
      
      await expect(contract.connect(owner).setValue(newValue))
        .to.emit(contract, 'ValueChanged')
        .withArgs(oldValue, newValue);
    });

    it('deposit()를 실행 후 Deposited 이벤트가 발생하는지', async function () {
      const depositAmount = ethers.parseEther('1');
      
      await expect(contract.connect(otherAccount).deposit({ value: depositAmount }))
        .to.emit(contract, 'Deposited')
        .withArgs(otherAccount.address, depositAmount);
    });

    it('withdraw()를 실행 후 Withdrawn 이벤트가 발생하는지', async function () {
      // 먼저 deposit
      const depositAmount = ethers.parseEther('1');
      await contract.connect(owner).deposit({ value: depositAmount });
      
      const withdrawAmount = ethers.parseEther('0.5');
      
      await expect(contract.connect(owner).withdraw(withdrawAmount))
        .to.emit(contract, 'Withdrawn')
        .withArgs(owner.address, withdrawAmount);
    });
  });

  describe('통합 테스트', function () {
    it('여러 계정의 deposit과 withdraw가 정상적으로 작동하는지', async function () {
      // 여러 계정이 deposit
      const deposit1 = ethers.parseEther('1');
      const deposit2 = ethers.parseEther('2');
      
      await contract.connect(owner).deposit({ value: deposit1 });
      await contract.connect(otherAccount).deposit({ value: deposit2 });
      
      // 잔액 확인
      expect(await contract.balances(owner.address)).to.equal(deposit1);
      expect(await contract.balances(otherAccount.address)).to.equal(deposit2);
      
      // owner만 withdraw 가능 (onlyOwner 모디파이어 때문)
      const withdraw1 = ethers.parseEther('0.5');
      
      await contract.connect(owner).withdraw(withdraw1);
      
      // 잔액 확인
      expect(await contract.balances(owner.address)).to.equal(deposit1 - withdraw1);
      expect(await contract.balances(otherAccount.address)).to.equal(deposit2);
    });
  });
});
